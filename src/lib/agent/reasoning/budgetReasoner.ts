/**
 * Evolution Sprint 1 — BudgetReasoner
 */

import { buildTravelerProfile } from './travelerProfileBuilder'
import {
  clamp01,
  clampScore,
  emptySlice,
  type ConsultantReasoningInput,
  type BudgetReasonerResult,
} from './consultantTypes'

export function reasonAboutBudget(input: ConsultantReasoningInput): BudgetReasonerResult {
  const profile = buildTravelerProfile(input)
  const amount = typeof input.known?.budgetAmount === 'number' ? input.known.budgetAmount : null
  const currency = input.known?.budgetCurrency ?? (amount != null ? 'SAR' : null)
  const stance = profile.profile.budgetStance
  const text = input.userText ?? ''

  const valueOverCheapest =
    stance === 'value_seeking'
    || stance === 'comfort_first'
    || stance === 'flexible'
    || /value|قيمة|worth|not just cheapest|مو بس الأرخص/i.test(text)
    || (!/cheap|أرخص only|lowest price/i.test(text) && amount == null)

  const stretchNotes: string[] = []
  if (stance === 'flexible') stretchNotes.push('Budget may stretch for clear value (location, fewer stops, safer timing).')
  if (stance === 'comfort_first') stretchNotes.push('Comfort prioritized over minimizing spend.')
  if (stance === 'strict' && amount != null) {
    stretchNotes.push('Treat amount as a hard ceiling until traveler relaxes it.')
  }
  if (valueOverCheapest) {
    stretchNotes.push('Optimize expected value, not sole minimum price.')
  }

  const missingInformation: string[] = []
  if (amount == null) missingInformation.push('budget_amount')
  if (stance === 'unknown') missingInformation.push('budget_stance')

  let confidence = amount != null ? 0.7 : 0.45
  if (stance !== 'unknown') confidence += 0.15

  const reasoning = [
    amount != null
      ? `Known budget signal: ${amount}${currency ? ` ${currency}` : ''}.`
      : 'No numeric budget yet — avoid inventing a price target.',
    `Budget stance=${stance}; valueOverCheapest=${valueOverCheapest}.`,
  ]

  return {
    ...emptySlice({
      confidence: clamp01(confidence),
      reasoning,
      tradeoffs: [
        valueOverCheapest
          ? 'Value-first may cost more than the cheapest package but reduce hassle/risk.'
          : 'Strict cheapest focus may sacrifice location, timing, or cancellation flexibility.',
      ],
      assumptions: [
        currency === 'SAR' || currency == null
          ? 'Default currency framing SAR when unspecified.'
          : `Respect stated currency ${currency}.`,
      ],
      missingInformation,
      recommendationScore: clampScore(amount != null ? 65 + (stance !== 'unknown' ? 15 : 0) : 40),
    }),
    budget: {
      amount,
      currency,
      stance,
      valueOverCheapest,
      stretchNotes,
    },
  }
}

export const BudgetReasoner = { reason: reasonAboutBudget }
