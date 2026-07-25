/**
 * Integration Sprint 9 — Budget & Pricing Intelligence engine.
 */

import type { AgentLocale, AgentMemory, TripPlan } from '../types'
import { mergeRequirements } from '../memory'
import { isIntegrationBudgetPricingEnabled } from './feature'
import { createBudgetEngine } from './budgetEngine'
import { buildCostBreakdown, type OfferPriceHints } from './breakdown'
import { buildBudgetTradeoffs } from './tradeoffs'
import { optimizeBudgetOptions } from './optimizer'
import { buildFlexibleAlternatives } from './flexible'
import { learnCostMemory, readCostMemory } from './costMemory'
import { detectBudgetPricingIntent, extractBudgetAmount } from './intents'
import { buildBudgetPricingSummary } from './consultant'
import { normalizeCurrency } from './currency'
import {
  INTEGRATION_BUDGET_PRICING_VERSION,
  type BudgetPricingResult,
  type BudgetTier,
} from './types'

export interface BudgetPricingDeps {
  enabled?: boolean
  userId?: string | null
  flightOffers?: Array<Record<string, unknown>>
  hotelStays?: Array<Record<string, unknown>>
  preferredTier?: BudgetTier | null
}

export interface RunBudgetPricingInput {
  memory: AgentMemory
  tripPlan?: TripPlan | null
  userText?: string | null
  locale?: AgentLocale
  deps?: BudgetPricingDeps
}

function disabled(latencyMs: number): BudgetPricingResult {
  return {
    version: INTEGRATION_BUDGET_PRICING_VERSION,
    enabled: false,
    ok: false,
    intent: 'unknown',
    envelope: null,
    breakdown: null,
    tradeoffs: [],
    options: [],
    primary: null,
    flexible: [],
    memory: readCostMemory(null),
    consultantSummaryEn: '',
    consultantSummaryAr: '',
    latencyMs,
    logs: ['budget_pricing_disabled'],
  }
}

export async function runBudgetPricing(
  input: RunBudgetPricingInput,
): Promise<BudgetPricingResult> {
  const started = Date.now()
  const enabled = isIntegrationBudgetPricingEnabled({ enabled: input.deps?.enabled })
  if (!enabled) return disabled(Date.now() - started)

  const logs = ['budget_pricing_enabled']
  const userText = input.userText?.trim() ?? ''
  const intent = detectBudgetPricingIntent(userText)
  logs.push(`intent:${intent}`)

  const extracted = extractBudgetAmount(userText)
  let requirements = input.memory.requirements
  if (extracted.amount != null) {
    requirements = mergeRequirements(requirements, {
      budgetAmount: extracted.amount,
      budgetCurrency: extracted.currency ?? requirements.budgetCurrency ?? 'SAR',
      budgetStyle:
        intent === 'luxury_worth_it'
          ? 'luxury'
          : intent === 'find_cheaper'
            ? 'budget'
            : requirements.budgetStyle,
    })
  } else if (intent === 'find_cheaper') {
    requirements = mergeRequirements(requirements, { budgetStyle: 'budget' })
  } else if (intent === 'luxury_worth_it') {
    requirements = mergeRequirements(requirements, { budgetStyle: 'luxury' })
  }

  const engine = createBudgetEngine()
  const memorySnap = readCostMemory(input.deps?.userId)
  const total = requirements.budgetAmount
    ?? memorySnap.preferredBudget
    ?? null

  if (total == null || total <= 0) {
    const summary = buildBudgetPricingSummary({
      intent,
      envelope: null,
      breakdown: null,
      tradeoffs: [],
      primary: null,
      flexible: [],
      options: [],
    })
    return {
      version: INTEGRATION_BUDGET_PRICING_VERSION,
      enabled: true,
      ok: false,
      intent,
      envelope: null,
      breakdown: null,
      tradeoffs: [],
      options: [],
      primary: null,
      flexible: [],
      memory: memorySnap,
      consultantSummaryEn: summary.en,
      consultantSummaryAr: summary.ar,
      latencyMs: Date.now() - started,
      logs: [...logs, 'missing_budget'],
    }
  }

  const plan = input.tripPlan ?? input.memory.tripPlan
  const envelope = engine.buildEnvelope({
    total,
    currency: normalizeCurrency(requirements.budgetCurrency ?? memorySnap.preferredCurrency ?? 'SAR'),
    travelers: requirements.travelers ?? plan?.travelers ?? 2,
    nights: Math.max(1, (requirements.durationDays ?? plan?.durationDays ?? 5) - 1),
    reserveRatio: requirements.budgetStyle === 'luxury' || memorySnap.luxuryPreference ? 0.1 : 0.08,
  })

  const offers: OfferPriceHints = {
    flightOffers: input.deps?.flightOffers,
    hotelStays: input.deps?.hotelStays,
  }

  const preferredTier = input.deps?.preferredTier
    ?? (intent === 'luxury_worth_it' || memorySnap.luxuryPreference
      ? 'luxury'
      : intent === 'find_cheaper'
        ? 'budget'
        : intent === 'optimize'
          ? 'best_value'
          : memorySnap.lastTier)

  const options = optimizeBudgetOptions({
    baseEnvelope: envelope,
    requirements,
    plan,
    offers,
    preferredTier,
  })
  const primary = options[0] ?? null
  const breakdown = primary?.breakdown
    ?? buildCostBreakdown({ envelope, tier: 'balanced', plan, requirements, offers })

  const tradeoffs = buildBudgetTradeoffs({
    breakdown,
    primary,
    alternatives: options.slice(1),
    flightHoursSaved: intent === 'luxury_worth_it' ? 2.5 : 1.5,
  })

  const flexible = (!breakdown.withinBudget || intent === 'find_cheaper')
    ? buildFlexibleAlternatives({
      breakdown,
      destination: plan?.destinations[0] ?? requirements.destination,
      currency: envelope.total.currency,
    })
    : []

  const learned = learnCostMemory({
    userId: input.deps?.userId,
    requirements,
    tier: primary?.tier ?? null,
    airline: typeof plan?.flights[0]?.airline === 'string' ? plan.flights[0].airline : null,
    hotelClass: plan?.accommodations[0]?.category ?? null,
  })

  const summary = buildBudgetPricingSummary({
    intent,
    envelope,
    breakdown,
    tradeoffs,
    primary,
    flexible,
    options,
  })

  logs.push(`primary:${primary?.tier ?? 'none'}`, `within:${breakdown.withinBudget}`)

  return {
    version: INTEGRATION_BUDGET_PRICING_VERSION,
    enabled: true,
    ok: true,
    intent,
    envelope,
    breakdown,
    tradeoffs,
    options,
    primary,
    flexible,
    memory: learned,
    consultantSummaryEn: summary.en,
    consultantSummaryAr: summary.ar,
    latencyMs: Date.now() - started,
    logs,
  }
}
