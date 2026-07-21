/**
 * Sprint 75 — parse budget utterances (conversation, no forms).
 */

import type { BudgetIntent } from './types'

export interface ParsedBudgetUtterance {
  amount: number | null
  minAmount: number | null
  maxAmount: number | null
  currency: string | null
  intent: BudgetIntent
  style: 'luxury' | 'midrange' | 'budget' | null
  flexible: boolean
  businessIfFits: boolean
}

function normalizeCurrency(text: string): string | null {
  const lower = text.toLowerCase()
  if (/\bsar\b|ر.?س|ريال/.test(lower) || /ريال/.test(text)) return 'SAR'
  if (/\baed\b|درهم/.test(lower) || /درهم/.test(text)) return 'AED'
  if (/\beur\b|€|يورو/.test(lower)) return 'EUR'
  if (/\bgbp\b|£|جنيه/.test(lower)) return 'GBP'
  if (/\$|usd|دولار/.test(lower) || /دولار/.test(text)) return 'USD'
  return null
}

function toNumber(raw: string): number | null {
  const amount = Number(raw.replace(/,/g, ''))
  if (!Number.isFinite(amount) || amount <= 0) return null
  return amount
}

export function parseBudgetUtterance(text: string): ParsedBudgetUtterance {
  const lower = text.toLowerCase()
  const original = text

  let intent: BudgetIntent = 'unknown'
  let style: ParsedBudgetUtterance['style'] = null
  let flexible = /\bflexible\b|ميزانية مرنة|مرنة/.test(lower)
  let businessIfFits = false

  if (/\bcheapest(?:\s+possible)?\b|أرخص|اقل سعر|أقل سعر/.test(lower)) {
    intent = 'cheapest'
    style = 'budget'
  } else if (/\bbest value\b|أفضل قيمة|افضل قيمة|value for money/.test(lower)) {
    intent = 'best_value'
    style = 'midrange'
  } else if (/\bpremium\b|بريميوم/.test(lower) && !/\bluxury\b|فاخر/.test(lower)) {
    intent = 'premium'
    style = 'midrange'
  } else if (/\bluxury\b|فاخر/.test(lower)) {
    intent = 'luxury'
    style = 'luxury'
  } else if (/\beconomy\b|اقتصادي/.test(lower) && !/\bbusiness\b/.test(lower)) {
    intent = 'economy'
    style = 'budget'
  }

  if (/\bbusiness(?:\s+class)?\b.*\b(?:within|if|under|budget)\b|\b(?:within|if|under)\b.*\bbusiness\b|درجة رجال الأعمال.*ميزانية/.test(lower)) {
    businessIfFits = true
    intent = intent === 'unknown' ? 'business_if_fits' : intent
  }

  // Range: between X and Y / from X to Y / X–Y
  const rangeEn = lower.match(
    /(?:between|from)\s*\$?\s*(\d+(?:[.,]\d+)?)\s*(?:and|to|-|–)\s*\$?\s*(\d+(?:[.,]\d+)?)/,
  )
  const rangeDash = lower.match(/\$?\s*(\d+(?:[.,]\d+)?)\s*[-–]\s*\$?\s*(\d+(?:[.,]\d+)?)/)

  let minAmount: number | null = null
  let maxAmount: number | null = null
  let amount: number | null = null

  if (rangeEn) {
    const a = toNumber(rangeEn[1]!)
    const b = toNumber(rangeEn[2]!)
    if (a != null && b != null) {
      minAmount = Math.min(a, b)
      maxAmount = Math.max(a, b)
      amount = maxAmount
      intent = intent === 'unknown' ? 'range' : intent
    }
  } else if (rangeDash && !/(?:under|below|max|budget|less than)/.test(lower.slice(0, rangeDash.index ?? 0 + 20))) {
    // only treat dash as range when not clearly a single "under" phrase nearby
    const a = toNumber(rangeDash[1]!)
    const b = toNumber(rangeDash[2]!)
    if (a != null && b != null && Math.abs(a - b) > Math.min(a, b) * 0.05) {
      minAmount = Math.min(a, b)
      maxAmount = Math.max(a, b)
      amount = maxAmount
      if (intent === 'unknown') intent = 'range'
    }
  }

  if (amount == null) {
    const underEn = lower.match(
      /(?:under|below|max(?:imum)?|less than|keep(?:\s+\w+)?\s+under|budget(?:\s+is)?|my budget is)\s*(?:of\s*)?(?:sar|usd|aed|eur|\$)?\s*\$?\s*(\d+(?:[.,]\d+)?)/,
    )
    const underAr = original.match(/(?:أقل من|اقل من|تحت|ميزانية|بميزانية)\s*(?:ريال|دولار|درهم)?\s*\$?\s*(\d+(?:[.,]\d+)?)/)
    const sarFirst = lower.match(/\b(?:sar|usd|aed|eur)\s*(\d+(?:[.,]\d+)?)/)
    const plainMoney = lower.match(/\$\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*(?:usd|sar|eur|aed|\$)/)
    const raw = underEn?.[1] || underAr?.[1] || sarFirst?.[1] || plainMoney?.[1] || plainMoney?.[2]
    if (raw) {
      amount = toNumber(raw)
      maxAmount = amount
      if (intent === 'unknown' || intent === 'luxury' || intent === 'premium') {
        intent = intent === 'luxury' || intent === 'premium' ? intent : 'under_cap'
      }
      // "Luxury but under 15,000"
      if (/\bluxury\b.*\bunder\b|\bunder\b.*\bluxury\b|فاخر.*أقل|أقل.*فاخر/.test(lower)) {
        intent = 'luxury'
        style = 'luxury'
      }
      flexible = false
    }
  }

  // "cheap" / "on a budget" without amount
  if (amount == null && style == null) {
    if (/\bcheap\b|\bon a budget\b|\bbudget trip\b|رخيص|رحلة اقتصادية/.test(lower)) {
      style = 'budget'
      if (intent === 'unknown') intent = 'cheapest'
    } else if (/\bmid[- ]?range\b|متوسط/.test(lower)) {
      style = 'midrange'
    }
  }

  const currency = normalizeCurrency(original) ?? (amount != null ? 'USD' : null)

  return {
    amount,
    minAmount,
    maxAmount: maxAmount ?? amount,
    currency,
    intent,
    style,
    flexible,
    businessIfFits,
  }
}
