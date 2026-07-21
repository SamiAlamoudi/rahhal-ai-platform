/**
 * Sprint 75 — Budget Intelligence orchestrator.
 */

import type { AgentMemory, TripPlan } from '../types'
import { allocateBudget, hotelNightlyCap } from './allocate'
import { parseBudgetUtterance } from './parseBudget'
import {
  rankFlightsByBudget,
  rankHotelsByBudget,
  rankPackagesByBudget,
  type FlightBudgetRow,
  type HotelBudgetRow,
} from './rank'
import type {
  BudgetDiagnostics,
  BudgetIntelligenceResult,
  RankedBudgetCandidate,
} from './types'
import { SPRINT75_BUDGET_INTELLIGENCE_VERSION } from './types'

export interface RunBudgetIntelligenceInput {
  memory: AgentMemory
  tripPlan?: TripPlan | null
  /** Latest user utterance (optional — improves intent parsing). */
  userText?: string | null
  flightOffers?: Array<Record<string, unknown>>
  hotelStays?: Array<Record<string, unknown>>
}

function readFlightRows(offers: Array<Record<string, unknown>>): FlightBudgetRow[] {
  return offers.map((offer, index) => {
    const price = typeof offer.price === 'number' ? offer.price : Number(offer.price) || 0
    const durationHours = typeof offer.durationHours === 'number' ? offer.durationHours : null
    const durationMinutes = typeof offer.durationMinutes === 'number'
      ? offer.durationMinutes
      : durationHours != null
        ? Math.round(durationHours * 60)
        : null
    const airline = typeof offer.airline === 'string' ? offer.airline : 'Flight'
    const from = String(offer.from ?? '')
    const to = String(offer.to ?? '')
    return {
      id: String(offer.id ?? `flt_${index}`),
      title: `${airline} ${from}→${to}`.trim(),
      price,
      currency: String(offer.currency ?? 'SAR'),
      durationMinutes,
      stops: typeof offer.stops === 'number' ? offer.stops : null,
      airline,
      cabin: typeof offer.cabin === 'string' ? offer.cabin : null,
      payload: offer,
    }
  })
}

function readHotelRows(stays: Array<Record<string, unknown>>, nights: number): HotelBudgetRow[] {
  return stays.map((stay, index) => {
    const nightly = typeof stay.nightly === 'number'
      ? stay.nightly
      : typeof stay.total === 'number'
        ? stay.total / Math.max(1, nights)
        : Number(stay.price) || 0
    const total = typeof stay.total === 'number' ? stay.total : nightly * Math.max(1, nights)
    return {
      id: String(stay.hotelId ?? stay.id ?? `htl_${index}`),
      title: String(stay.name ?? `Stay ${index + 1}`),
      price: total,
      currency: String(stay.currency ?? 'SAR'),
      rating: typeof stay.rating === 'number' ? stay.rating : typeof stay.score === 'number' ? stay.score : null,
      stars: typeof stay.hotelStars === 'number' ? stay.hotelStars : null,
      payload: { ...stay, nightly, total },
    }
  })
}

export function buildBudgetDiagnostics(input: {
  memory: AgentMemory
  userText?: string | null
  spentTotal?: number | null
}): { diagnostics: BudgetDiagnostics; allocation: BudgetIntelligenceResult['allocation']; parsed: ReturnType<typeof parseBudgetUtterance> } {
  const req = input.memory.requirements
  const parsed = parseBudgetUtterance(input.userText ?? '')

  const amount = parsed.amount ?? req.budgetAmount
  const currency = parsed.currency ?? req.budgetCurrency ?? (amount != null ? 'SAR' : null)
  const style = parsed.style ?? req.budgetStyle
  const flexible = parsed.flexible || req.budgetFlexible === true
  const minAmount = parsed.minAmount
  const maxAmount = parsed.maxAmount ?? amount

  const missingBudget = amount == null && !flexible
  const budgetDetected = amount != null || parsed.intent !== 'unknown' || style != null

  let allocation: BudgetIntelligenceResult['allocation'] = null
  if (amount != null && currency) {
    allocation = allocateBudget({
      total: amount,
      currency,
      intent: parsed.intent,
      style,
      nights: Math.max(1, (req.durationDays ?? 3) - 1),
      flightsOnly: req.packageScope === 'flights_only',
    })
  }

  const spent = input.spentTotal ?? null
  let remainingBudget: number | null = null
  let overflow = false
  let underflow = false
  if (amount != null && spent != null) {
    remainingBudget = Math.round(amount - spent)
    overflow = spent > amount
    underflow = spent < amount * 0.45
  }

  const diagnostics: BudgetDiagnostics = {
    budgetDetected,
    currency,
    amount,
    minAmount,
    maxAmount,
    intent: parsed.intent,
    style,
    flexible,
    allocatedBudget: allocation,
    remainingBudget,
    budgetScore: null,
    overflow,
    underflow,
    missingBudget,
  }

  return { diagnostics, allocation, parsed }
}

export function runBudgetIntelligence(input: RunBudgetIntelligenceInput): BudgetIntelligenceResult {
  const started = Date.now()
  const req = input.memory.requirements
  const nights = Math.max(1, (req.durationDays ?? input.tripPlan?.durationDays ?? 3) - 1)

  const flightOffers = input.flightOffers
    ?? (input.tripPlan?.flights ?? []).map((f, i) => ({
      id: `plan_flt_${i}`,
      airline: f.airline,
      from: f.from,
      to: f.to,
      price: f.estimatedCost ?? 0,
      currency: f.currency,
      stops: f.stops,
    }))

  const hotelStays = input.hotelStays
    ?? (input.tripPlan?.accommodations ?? []).map((h, i) => ({
      id: `plan_htl_${i}`,
      name: h.name,
      nightly: h.estimatedNightly ?? 0,
      currency: h.currency,
      area: h.area,
    }))

  // Estimate spent from top candidates after ranking prep
  const { diagnostics, allocation, parsed } = buildBudgetDiagnostics({
    memory: input.memory,
    userText: input.userText,
  })

  const flightCap = allocation?.flights ?? diagnostics.maxAmount
  const hotelCap = allocation?.hotels ?? diagnostics.maxAmount

  const rankedFlights = rankFlightsByBudget(readFlightRows(flightOffers), {
    budgetCap: flightCap,
    budgetMin: diagnostics.minAmount != null && allocation
      ? Math.round(diagnostics.minAmount * (allocation.flights / allocation.total))
      : diagnostics.minAmount,
    intent: parsed.intent,
    style: diagnostics.style,
  })

  const rankedHotels = rankHotelsByBudget(readHotelRows(hotelStays, nights), {
    budgetCap: hotelCap,
    budgetMin: diagnostics.minAmount != null && allocation
      ? Math.round(diagnostics.minAmount * (allocation.hotels / allocation.total))
      : null,
    intent: parsed.intent,
    style: diagnostics.style,
  })

  const packages: RankedBudgetCandidate[] = []
  const topFlight = rankedFlights[0]
  const topHotel = rankedHotels[0]
  if (topFlight && topHotel) {
    packages.push(...rankPackagesByBudget([{
      id: `pkg_${topFlight.id}_${topHotel.id}`,
      title: `${topFlight.title} + ${topHotel.title}`,
      price: topFlight.price + topHotel.price,
      currency: topFlight.currency,
      flightDurationMinutes: typeof topFlight.payload.durationMinutes === 'number'
        ? topFlight.payload.durationMinutes as number
        : null,
      hotelRating: typeof topHotel.payload.rating === 'number'
        ? topHotel.payload.rating as number
        : null,
      payload: { flightId: topFlight.id, hotelId: topHotel.id },
    }], {
      budgetCap: diagnostics.maxAmount,
      budgetMin: diagnostics.minAmount,
      intent: parsed.intent,
      style: diagnostics.style,
    }))
  }

  // Also build packages from top-3 × top-3 for combined ranking
  for (const f of rankedFlights.slice(0, 3)) {
    for (const h of rankedHotels.slice(0, 3)) {
      if (f === topFlight && h === topHotel) continue
      packages.push(...rankPackagesByBudget([{
        id: `pkg_${f.id}_${h.id}`,
        title: `${f.title} + ${h.title}`,
        price: f.price + h.price,
        currency: f.currency,
        payload: { flightId: f.id, hotelId: h.id },
      }], {
        budgetCap: diagnostics.maxAmount,
        budgetMin: diagnostics.minAmount,
        intent: parsed.intent,
        style: diagnostics.style,
      }))
    }
  }
  packages.sort((a, b) => b.score.budgetScore - a.score.budgetScore)

  const bestPackage = packages[0]
  const spentTotal = bestPackage?.price
    ?? ((topFlight?.price ?? 0) + (topHotel?.price ?? 0) || null)

  let remainingBudget: number | null = diagnostics.remainingBudget
  let overflow = diagnostics.overflow
  let underflow = diagnostics.underflow
  if (diagnostics.amount != null && spentTotal != null && spentTotal > 0) {
    remainingBudget = Math.round(diagnostics.amount - spentTotal)
    overflow = spentTotal > diagnostics.amount
    underflow = spentTotal < diagnostics.amount * 0.45
  }

  const budgetScore = bestPackage?.score.budgetScore
    ?? topFlight?.score.budgetScore
    ?? topHotel?.score.budgetScore
    ?? null

  const finalDiagnostics: BudgetDiagnostics = {
    ...diagnostics,
    remainingBudget,
    overflow,
    underflow,
    budgetScore,
    allocatedBudget: allocation,
  }

  const facts: string[] = []
  if (finalDiagnostics.missingBudget) {
    facts.push('Budget not detected yet — share a max budget (e.g. SAR 8,000) when ready.')
  } else if (finalDiagnostics.budgetDetected && finalDiagnostics.amount != null) {
    facts.push(
      `Budget detected: ${finalDiagnostics.currency ?? ''} ${finalDiagnostics.amount}`.trim()
      + (finalDiagnostics.intent !== 'unknown' ? ` · intent ${finalDiagnostics.intent}` : ''),
    )
  }
  if (allocation) {
    facts.push(
      `Allocated — flights ${allocation.flights}, hotels ${allocation.hotels}, transport ${allocation.transportation}, activities ${allocation.activities} ${allocation.currency}`
      + (nights > 0 ? ` (≈${hotelNightlyCap(allocation, nights)}/night hotels)` : ''),
    )
  }
  if (bestPackage) {
    facts.push(
      `Best budget-fit package score ${bestPackage.score.budgetScore}/100 · ${bestPackage.price} ${bestPackage.currency}`
      + (remainingBudget != null ? ` · remaining ${remainingBudget}` : ''),
    )
  }
  if (overflow) facts.push('Selected package exceeds your budget — showing best in-budget alternatives when available.')
  if (underflow && !overflow) facts.push('Current picks use well under your budget — room for upgrades if you want.')

  return {
    version: SPRINT75_BUDGET_INTELLIGENCE_VERSION,
    diagnostics: finalDiagnostics,
    allocation,
    rankedFlights: rankedFlights.slice(0, 8),
    rankedHotels: rankedHotels.slice(0, 8),
    rankedPackages: packages.slice(0, 8),
    recommendationFacts: facts,
    durationMs: Date.now() - started,
  }
}
