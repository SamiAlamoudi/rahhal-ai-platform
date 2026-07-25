/**
 * Integration Sprint 9 — soft enrich conversation from Budget & Pricing Intelligence.
 * When flag OFF, returns inputs unchanged. Does not rewrite live providers.
 */

import type { AgentLocale, AgentMemory, TripPlan } from '../types'
import { mergeRequirements } from '../memory'
import { isIntegrationBudgetPricingEnabled } from './feature'
import { runBudgetPricing, type BudgetPricingDeps } from './engine'
import { isBudgetPricingAsk, extractBudgetAmount } from './intents'
import type { BudgetPricingResult } from './types'

export function shouldRunBudgetPricing(input: {
  userText?: string | null
  memory: AgentMemory
  force?: boolean
}): boolean {
  if (input.force) return true
  const text = input.userText?.trim() ?? ''
  if (!text) return false
  if (isBudgetPricingAsk(text)) return true
  if (
    input.memory.tripPlan
    && typeof input.memory.requirements.budgetAmount === 'number'
    && /budget|price|cost|ميزانية|سعر|تكلفة/i.test(text)
  ) {
    return true
  }
  return false
}

export async function enrichWithIntegrationBudgetPricing(input: {
  memory: AgentMemory
  userText?: string | null
  reply?: string | null
  tripPlan?: TripPlan | null
  locale?: AgentLocale
  enabled?: boolean
  force?: boolean
  deps?: BudgetPricingDeps
}): Promise<{
  memory: AgentMemory
  tripPlan: TripPlan | null
  reply: string | null
  budgetPricing: BudgetPricingResult | null
}> {
  const tripPlan = input.tripPlan ?? input.memory.tripPlan
  if (!isIntegrationBudgetPricingEnabled({ enabled: input.enabled })) {
    return {
      memory: input.memory,
      tripPlan,
      reply: input.reply ?? null,
      budgetPricing: null,
    }
  }

  if (!shouldRunBudgetPricing({
    userText: input.userText,
    memory: input.memory,
    force: input.force,
  })) {
    return {
      memory: input.memory,
      tripPlan,
      reply: input.reply ?? null,
      budgetPricing: null,
    }
  }

  const result = await runBudgetPricing({
    memory: input.memory,
    tripPlan,
    userText: input.userText,
    locale: input.locale ?? input.memory.locale,
    deps: { ...input.deps, enabled: true },
  })

  if (!result.enabled) {
    return {
      memory: input.memory,
      tripPlan,
      reply: input.reply ?? null,
      budgetPricing: result,
    }
  }

  const locale = input.locale ?? input.memory.locale
  const summary = locale === 'en' ? result.consultantSummaryEn : result.consultantSummaryAr
  const existing = input.reply?.trim() ?? ''
  const reply = summary
    ? (existing && existing.length > summary.length + 80 ? `${summary}\n\n${existing}` : summary)
    : (input.reply ?? null)

  let nextMemory = input.memory
  const extracted = extractBudgetAmount(input.userText)
  if (extracted.amount != null) {
    nextMemory = {
      ...nextMemory,
      requirements: mergeRequirements(nextMemory.requirements, {
        budgetAmount: extracted.amount,
        budgetCurrency: extracted.currency ?? nextMemory.requirements.budgetCurrency ?? 'SAR',
      }),
    }
  }

  let nextPlan = tripPlan
  if (nextPlan && result.breakdown) {
    const note = locale === 'en'
      ? `Budget pricing: ${result.consultantSummaryEn.split(/[.。]/)[0]}`
      : `تسعير الميزانية: ${result.consultantSummaryAr.split(/[.。]/)[0]}`
    nextPlan = {
      ...nextPlan,
      notes: [...nextPlan.notes, note].slice(-12),
      estimatedBudget: {
        amount: result.breakdown.estimatedTotal,
        currency: result.breakdown.currency,
        breakdown: [
          { label: 'Flights', amount: result.breakdown.flights },
          { label: 'Hotels', amount: result.breakdown.hotels },
          { label: 'Transportation', amount: result.breakdown.transportation },
          { label: 'Meals', amount: result.breakdown.meals },
          { label: 'Activities', amount: result.breakdown.activities },
          { label: 'Insurance', amount: result.breakdown.insurance },
          { label: 'Taxes', amount: result.breakdown.taxes },
          { label: 'Reserve', amount: result.breakdown.reserveHeld },
        ],
      },
      estimatedCosts: {
        amount: result.breakdown.estimatedTotal,
        currency: result.breakdown.currency,
        breakdown: [
          { label: 'Flights', amount: result.breakdown.flights },
          { label: 'Hotels', amount: result.breakdown.hotels },
          { label: 'Transportation', amount: result.breakdown.transportation },
          { label: 'Meals', amount: result.breakdown.meals },
          { label: 'Activities', amount: result.breakdown.activities },
          { label: 'Insurance', amount: result.breakdown.insurance },
          { label: 'Taxes', amount: result.breakdown.taxes },
        ],
      },
    }
    nextMemory = { ...nextMemory, tripPlan: nextPlan, itinerary: nextPlan }
  }

  return {
    memory: nextMemory,
    tripPlan: nextPlan,
    reply,
    budgetPricing: result,
  }
}

export function toBudgetPricingMeta(
  result: BudgetPricingResult | null | undefined,
): {
  intent: string
  tier: string | null
  total: number | null
  currency: string | null
  withinBudget: boolean | null
  tradeoffCount: number
  flexibleCount: number
  summary: string
  latencyMs: number
} | undefined {
  if (!result?.enabled) return undefined
  return {
    intent: result.intent,
    tier: result.primary?.tier ?? null,
    total: result.envelope?.total.amount ?? null,
    currency: result.envelope?.total.currency ?? null,
    withinBudget: result.breakdown?.withinBudget ?? null,
    tradeoffCount: result.tradeoffs.length,
    flexibleCount: result.flexible.length,
    summary: result.consultantSummaryEn || result.consultantSummaryAr,
    latencyMs: result.latencyMs,
  }
}
