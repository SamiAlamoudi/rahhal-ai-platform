/**
 * Evolution Sprint 8 — budget / comfort / opportunity-cost strategy signals.
 */

import { clampScore, type TravelStrategyContext } from './strategyTypes'

export function evaluateBudgetStrategy(ctx: TravelStrategyContext): {
  budgetAction: 'keep' | 'increase' | 'decrease' | 'reallocate' | 'unknown'
  budgetScore: number
  notes: string[]
  missing: string[]
  worthIncreasing: boolean | null
} {
  const missing: string[] = []
  const notes: string[] = []
  if (typeof ctx.budgetAmount !== 'number') {
    missing.push('budget_amount')
    return {
      budgetAction: 'unknown',
      budgetScore: 45,
      notes: ['Budget amount unknown — cannot judge efficiency.'],
      missing,
      worthIncreasing: null,
    }
  }

  const stance = ctx.budgetStance ?? 'unknown'
  const cost = ctx.destinationPriors?.costBand
  let budgetScore = 60
  let budgetAction: 'keep' | 'increase' | 'decrease' | 'reallocate' | 'unknown' = 'keep'
  let worthIncreasing: boolean | null = false

  notes.push(
    `Known budget ${ctx.budgetAmount}${ctx.budgetCurrency ? ` ${ctx.budgetCurrency}` : ''}; stance=${stance}.`,
  )

  if (cost === 'luxury' || cost === 'premium') {
    if (stance === 'strict') {
      budgetScore = 35
      budgetAction = 'increase'
      worthIncreasing = true
      notes.push('Premium/luxury cost band with strict stance — increasing budget may unlock viable comfort.')
    } else if (stance === 'value_seeking' || stance === 'flexible') {
      budgetScore = 65
      budgetAction = 'reallocate'
      notes.push('Reallocate toward fewer nights or better location rather than lowest sticker price.')
    } else {
      budgetScore = 70
      budgetAction = 'keep'
    }
  } else if (cost === 'budget' || cost === 'moderate') {
    budgetScore = 75
    budgetAction = 'keep'
    notes.push('Cost band prior fits a contained budget strategy.')
  } else {
    missing.push('destination_cost_band')
    notes.push('Destination cost band unknown — budget efficiency provisional.')
  }

  if (ctx.travelerHints?.preferValueOverCheapest) {
    notes.push('Traveler prefers value over cheapest — avoid pure price-minimization.')
    if (budgetAction === 'keep') budgetAction = 'reallocate'
  }

  return {
    budgetAction,
    budgetScore: clampScore(budgetScore),
    notes,
    missing,
    worthIncreasing,
  }
}

export function evaluateOpportunityCost(ctx: TravelStrategyContext): {
  notes: string[]
  score: number
} {
  const notes: string[] = []
  let score = 55
  if (ctx.destinationPriors?.weaknesses?.length) {
    notes.push(
      `Staying the course forgoes fixing known weaknesses: ${ctx.destinationPriors.weaknesses.slice(0, 2).join('; ')}.`,
    )
    score = 45
  }
  if (typeof ctx.monthHint === 'number' && ctx.destinationPriors?.worstSeasons?.includes(ctx.monthHint)) {
    notes.push('Traveling in a worst-season month forgoes better weather/crowd value later.')
    score = 35
  }
  if (!notes.length) {
    notes.push('Opportunity cost limited to known constraints — no alternate city invented.')
  }
  return { notes, score: clampScore(score) }
}

export function evaluateComfortVsCost(ctx: TravelStrategyContext): {
  prioritizeComfort: boolean | null
  comfortScore: number
  notes: string[]
} {
  const notes: string[] = []
  if (ctx.travelerHints?.preferComfort || (ctx.travelerHints?.luxuryLean ?? 0) > 0.5) {
    notes.push('Traveler comfort/luxury lean suggests paying more for friction reduction may be worth it.')
    return { prioritizeComfort: true, comfortScore: 80, notes }
  }
  if (ctx.budgetStance === 'strict') {
    notes.push('Strict budget stance — comfort upgrades need explicit traveler consent.')
    return { prioritizeComfort: false, comfortScore: 45, notes }
  }
  if (ctx.pace === 'relaxed') {
    notes.push('Relaxed pace aligns with comfort-preserving strategy.')
    return { prioritizeComfort: true, comfortScore: 70, notes }
  }
  notes.push('Comfort vs cost preference not explicit — keep balanced.')
  return { prioritizeComfort: null, comfortScore: 55, notes }
}

export const BudgetStrategy = { evaluate: evaluateBudgetStrategy }
export const OpportunityCost = { evaluate: evaluateOpportunityCost }
export const ComfortCostStrategy = { evaluate: evaluateComfortVsCost }
