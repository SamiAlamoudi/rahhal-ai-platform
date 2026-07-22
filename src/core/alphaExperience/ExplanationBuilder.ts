/**
 * Sprint 91 — natural-language explanation layer (no internal prompts).
 */

import type { AlphaExplanation } from './types'

export function buildAlphaExplanation(input: {
  flightAirline?: string | null
  flightPrice?: number | null
  hotelName?: string | null
  hotelPrice?: number | null
  packageTitle?: string | null
  packageScore?: number | null
  currency?: string
  budgetCap?: number | null
  totalPrice?: number | null
  durationMinutes?: number | null
  decisionExplanation?: string | null
  refinementSummary?: string | null
  tradeoffs?: string[]
}): AlphaExplanation {
  const currency = input.currency ?? 'SAR'
  const airline = input.flightAirline ?? 'the selected flight'
  const hotel = input.hotelName ?? 'the selected hotel'
  const pkg = input.packageTitle ?? 'this package'

  const whyFlight = input.flightPrice != null
    ? `${airline} balances schedule and price (${input.flightPrice} ${currency}) for your route.`
    : `${airline} is the best available match for your travel window.`

  const whyHotel = input.hotelPrice != null
    ? `${hotel} fits your stay needs at about ${input.hotelPrice} ${currency}.`
    : `${hotel} best matches location and comfort preferences.`

  const whyPackage = input.packageScore != null
    ? `${pkg} scores ${Math.round(input.packageScore)}/100 across value, fit, and reliability.`
    : `${pkg} combines flight, stay, and extras into one coherent trip.`

  const tradeoffs = (input.tradeoffs && input.tradeoffs.length > 0)
    ? input.tradeoffs
    : [
      'A cheaper option may add longer travel time or fewer amenities.',
      'A luxury upgrade improves comfort but raises total cost.',
    ]

  let budgetImpact = 'Budget impact is within a typical range for this destination.'
  if (input.budgetCap != null && input.totalPrice != null) {
    const delta = input.totalPrice - input.budgetCap
    if (delta > 0) {
      budgetImpact = `About ${Math.round(delta)} ${currency} above your stated budget — consider value or date flexibility.`
    } else {
      budgetImpact = `About ${Math.round(Math.abs(delta))} ${currency} under your stated budget.`
    }
  } else if (input.totalPrice != null) {
    budgetImpact = `Estimated trip cost is ${Math.round(input.totalPrice)} ${currency}.`
  }

  const timeImpact = input.durationMinutes != null
    ? `Primary flight duration is roughly ${Math.round(input.durationMinutes / 60)} hours.`
    : (input.refinementSummary
      ? `Schedule notes: ${input.refinementSummary}`
      : 'Travel time is optimized for a practical arrival and check-in buffer.')

  const qualityImpact = input.packageScore != null && input.packageScore >= 75
    ? 'Quality signals (ratings, convenience, reliability) are strong for this pick.'
    : 'Quality is balanced against price — upgrades are available in alternatives.'

  const summaryParts = [
    whyPackage,
    input.decisionExplanation?.split('\n')[0]?.trim() || null,
  ].filter(Boolean)

  return {
    whyFlight,
    whyHotel,
    whyPackage,
    tradeoffs,
    budgetImpact,
    timeImpact,
    qualityImpact,
    summary: summaryParts.join(' '),
  }
}
