/**
 * Integration Sprint 9 — conversational budget intents.
 */

import { parseBudgetUtterance } from '../budgetIntelligence/parseBudget'
import type { BudgetPricingIntent } from './types'

export function detectBudgetPricingIntent(userText: string | null | undefined): BudgetPricingIntent {
  const t = (userText ?? '').trim()
  if (!t) return 'unknown'
  const lower = t.toLowerCase()
  if (/find something cheaper|أرخص|خفض السعر|cheaper/i.test(t)) return 'find_cheaper'
  if (/stay under|under my budget|لا تتجاوز|ضمن ميزانيتي|ابقَ? تحت/i.test(t)) return 'stay_under'
  if (/luxury but worth|فاخر.*يستحق|worth it|قيمة الفاخر/i.test(t)) return 'luxury_worth_it'
  if (/break\s*down|تفاصيل التكلفة|cost breakdown|كم يكلف/i.test(t)) return 'breakdown'
  if (/optim|أفضل قيمة|best value|وازن الميزانية/i.test(t)) return 'optimize'

  const parsed = parseBudgetUtterance(t)
  if (parsed.amount != null || /(?:SAR|USD|EUR|ر\.?\s?س|ريال)\s*\d+/i.test(t) || /\d+\s*(?:SAR|USD|EUR|ريال)/i.test(t)) {
    return 'set_budget'
  }
  if (parsed.intent !== 'unknown') {
    if (parsed.intent === 'cheapest' || parsed.intent === 'economy') return 'find_cheaper'
    if (parsed.intent === 'luxury' || parsed.intent === 'premium') return 'luxury_worth_it'
    if (parsed.intent === 'under_cap' || parsed.intent === 'best_value') return 'stay_under'
  }
  if (/budget|ميزانية/.test(lower)) return 'optimize'
  return 'unknown'
}

export function isBudgetPricingAsk(userText: string | null | undefined): boolean {
  return detectBudgetPricingIntent(userText) !== 'unknown'
}

export function extractBudgetAmount(userText: string | null | undefined): {
  amount: number | null
  currency: string | null
} {
  const parsed = parseBudgetUtterance(userText ?? '')
  return { amount: parsed.amount, currency: parsed.currency }
}
