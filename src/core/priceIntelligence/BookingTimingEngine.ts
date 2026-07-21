/**
 * Sprint 81 — Booking Timing Engine (BOOK_NOW / WAIT / WATCH / …).
 */

import { confidenceFromAnalysis } from './ConfidenceCalculator'
import { detectOpportunities } from './OpportunityDetector'
import { analyzePrices } from './PriceAnalyzer'
import { emitPriceEvent, type PriceEvent } from './events'
import {
  formatTimingExplanation,
  SPRINT81_PRICE_INTELLIGENCE_VERSION,
  type BookingTimingAction,
  type PriceIntelligenceInput,
  type TimingRecommendation,
} from './TimingRecommendation'

export interface BookingTimingResult {
  version: string
  recommendation: TimingRecommendation
  events: PriceEvent[]
  durationMs: number
}

function pickAction(input: {
  analysis: ReturnType<typeof analyzePrices>
  opportunities: ReturnType<typeof detectOpportunities>
  seatsRemaining: number | null
  roomsRemaining: number | null
  confidence: number
}): {
  action: BookingTimingAction
  reason: string
  positiveIndicators: string[]
  negativeIndicators: string[]
  signalsUsed: string[]
} {
  const { analysis, opportunities, seatsRemaining, roomsRemaining, confidence } = input
  const signalsUsed: string[] = [
    'current_price',
    'average_observed_price',
    'price_volatility',
    'price_trend',
  ]
  if (analysis.daysToDeparture != null) signalsUsed.push('departure_proximity', 'booking_window')
  if (analysis.priceVsBudgetRatio != null) signalsUsed.push('budget_cap')
  signalsUsed.push('demand_indicator', 'trip_season')
  if (analysis.isWeekendTravel) signalsUsed.push('weekend_effect')
  if (analysis.isHolidayPeriod) signalsUsed.push('holiday_effect')
  if (seatsRemaining != null || roomsRemaining != null) signalsUsed.push('availability')
  if (analysis.cheapestOption != null) signalsUsed.push('cheapest_option')
  if (analysis.premiumOption != null) signalsUsed.push('premium_option')

  const positiveIndicators: string[] = []
  const negativeIndicators: string[] = []
  const ratio = analysis.priceVsAverageRatio
  const budgetRatio = analysis.priceVsBudgetRatio

  if (ratio != null && ratio <= 0.95) positiveIndicators.push('prices are below the observed average')
  if (ratio != null && ratio >= 1.1) negativeIndicators.push('prices are above the observed average')
  if (budgetRatio != null && budgetRatio > 1.1) negativeIndicators.push('price exceeds the budget')
  if (budgetRatio != null && budgetRatio <= 0.9) positiveIndicators.push('fits comfortably under budget')
  if (analysis.trend === 'rising') negativeIndicators.push('prices are trending up')
  if (analysis.trend === 'falling') positiveIndicators.push('prices are trending down')
  if (analysis.demand === 'high') negativeIndicators.push('demand is elevated')
  if (analysis.demand === 'low') positiveIndicators.push('demand is low')
  if (analysis.season === 'peak') negativeIndicators.push('peak-season travel')
  if (analysis.season === 'off') positiveIndicators.push('off-season timing')
  if (analysis.isWeekendTravel) negativeIndicators.push('weekend travel premium risk')
  if (analysis.isHolidayPeriod) negativeIndicators.push('holiday-period pricing pressure')
  if (opportunities.includes('exceptional_bargain')) positiveIndicators.push('exceptional bargain detected')
  if (opportunities.includes('price_spike')) negativeIndicators.push('price spike detected')
  if (opportunities.includes('likely_increase')) negativeIndicators.push('further increases are likely')
  if (opportunities.includes('likely_decrease')) positiveIndicators.push('a decrease is still plausible')
  if (opportunities.includes('high_uncertainty')) negativeIndicators.push('market uncertainty is high')
  if (seatsRemaining != null && seatsRemaining <= 5) {
    negativeIndicators.push('availability is decreasing')
    signalsUsed.push('limited_seats')
  }
  if (roomsRemaining != null && roomsRemaining <= 3) {
    negativeIndicators.push('room availability is tight')
    signalsUsed.push('limited_rooms')
  }

  // 1) Limited availability (highest urgency)
  const limitedSeats = seatsRemaining != null && seatsRemaining <= 3
  const limitedRooms = roomsRemaining != null && roomsRemaining <= 2
  if (limitedSeats || limitedRooms) {
    return {
      action: 'LIMITED_AVAILABILITY',
      reason: 'Book soon — inventory is limited.',
      positiveIndicators: [
        ...positiveIndicators,
        limitedSeats ? 'few seats remain' : 'few rooms remain',
      ],
      negativeIndicators,
      signalsUsed,
    }
  }

  // 2) Insufficient confidence / data
  if (confidence < 40 || (analysis.observationCount < 1 && ratio == null)) {
    return {
      action: 'NO_CONFIDENT_RECOMMENDATION',
      reason: 'Not enough reliable pricing signal yet.',
      positiveIndicators,
      negativeIndicators,
      signalsUsed,
    }
  }

  // 3) Price too high vs budget or severe spike
  const severeSpike = opportunities.includes('price_spike') && (ratio ?? 0) >= 1.3
  const overBudget = budgetRatio != null && budgetRatio > 1.15
  if (overBudget || severeSpike) {
    return {
      action: 'PRICE_TOO_HIGH',
      reason: overBudget
        ? 'Price is too high relative to your budget.'
        : 'Current price is far above the observed average.',
      positiveIndicators,
      negativeIndicators,
      signalsUsed,
    }
  }

  // 4) Book now — bargain, rising + proximity, or below average with demand/availability pressure
  const bargain = opportunities.includes('exceptional_bargain') || (ratio != null && ratio <= 0.92)
  const closeDeparture = analysis.daysToDeparture != null && analysis.daysToDeparture <= 10
  const risingPressure = opportunities.includes('likely_increase')
    || analysis.trend === 'rising'
    || analysis.demand === 'high'
    || analysis.isHolidayPeriod
  const availabilityPressure = (seatsRemaining != null && seatsRemaining <= 8)
    || (roomsRemaining != null && roomsRemaining <= 5)

  if (
    bargain
    || (closeDeparture && risingPressure)
    || (ratio != null && ratio <= 1.0 && (risingPressure || availabilityPressure))
  ) {
    const bookPositives = [...positiveIndicators]
    if (availabilityPressure) {
      bookPositives.push('availability is decreasing')
    }
    if (risingPressure && !bookPositives.some((p) => p.includes('trending') || p.includes('increases'))) {
      bookPositives.push('further increases are likely')
    }
    return {
      action: 'BOOK_NOW',
      reason: 'Book now because',
      positiveIndicators: bookPositives.length > 0
        ? bookPositives
        : ['the current fare looks favorable'],
      negativeIndicators,
      signalsUsed,
    }
  }

  // 5) Wait — elevated price, decrease plausible, enough runway
  const farOut = analysis.daysToDeparture == null || analysis.daysToDeparture > 21
  const waitSignal = opportunities.includes('likely_decrease')
    || (ratio != null && ratio >= 1.08 && analysis.demand === 'low' && analysis.trend !== 'rising')
  if (farOut && waitSignal && !opportunities.includes('exceptional_bargain')) {
    return {
      action: 'WAIT',
      reason: 'Wait because',
      positiveIndicators: positiveIndicators.length > 0
        ? positiveIndicators
        : ['there is still time before departure'],
      negativeIndicators,
      signalsUsed,
    }
  }

  // 6) Watch — volatile / mid-band / uncertain
  if (
    opportunities.includes('high_uncertainty')
    || analysis.trend === 'volatile'
    || (ratio != null && ratio > 0.95 && ratio < 1.12)
  ) {
    return {
      action: 'WATCH_PRICE',
      reason: 'Watch the price — the market is mixed.',
      positiveIndicators,
      negativeIndicators,
      signalsUsed,
    }
  }

  // 7) Fallback watch / no confidence
  if (confidence < 55) {
    return {
      action: 'NO_CONFIDENT_RECOMMENDATION',
      reason: 'Signals conflict; no confident timing call.',
      positiveIndicators,
      negativeIndicators,
      signalsUsed,
    }
  }

  return {
    action: 'WATCH_PRICE',
    reason: 'Watch the price for a clearer move.',
    positiveIndicators,
    negativeIndicators,
    signalsUsed,
  }
}

export class BookingTimingEngine {
  analyze(input: PriceIntelligenceInput): BookingTimingResult {
    const started = Date.now()
    const events: PriceEvent[] = []
    emitPriceEvent('price.analysis.started', {
      currentPrice: input.currentPrice,
      currency: input.currency,
    }, events)

    if (!Number.isFinite(input.currentPrice) || input.currentPrice <= 0) {
      const analysis = analyzePrices({
        ...input,
        currentPrice: Math.max(0, input.currentPrice || 0),
      })
      const recommendation: TimingRecommendation = {
        action: 'NO_CONFIDENT_RECOMMENDATION',
        reason: 'Current price is missing or invalid.',
        confidence: 10,
        signalsUsed: ['current_price'],
        positiveIndicators: [],
        negativeIndicators: ['invalid current price'],
        explanation: 'Current price is missing or invalid. Confidence 10% — not enough signal for a firm call.',
        opportunities: ['high_uncertainty'],
        analysis,
      }
      emitPriceEvent('booking.recommendation', { action: recommendation.action }, events)
      emitPriceEvent('price.analysis.finished', { action: recommendation.action }, events)
      return {
        version: SPRINT81_PRICE_INTELLIGENCE_VERSION,
        recommendation,
        events,
        durationMs: Date.now() - started,
      }
    }

    const analysis = analyzePrices(input)
    const opportunities = detectOpportunities(analysis, events)
    const confidence = confidenceFromAnalysis(analysis, {
      hasBudget: input.budgetCap != null && input.budgetCap > 0,
      availabilityKnown: input.seatsRemaining != null || input.roomsRemaining != null,
    })
    emitPriceEvent('timing.confidence', { confidence }, events)

    const picked = pickAction({
      analysis,
      opportunities,
      seatsRemaining: input.seatsRemaining ?? null,
      roomsRemaining: input.roomsRemaining ?? null,
      confidence,
    })

    const recommendation: TimingRecommendation = {
      action: picked.action,
      reason: picked.reason,
      confidence,
      signalsUsed: [...new Set(picked.signalsUsed)],
      positiveIndicators: picked.positiveIndicators,
      negativeIndicators: picked.negativeIndicators,
      explanation: formatTimingExplanation({
        action: picked.action,
        reason: picked.reason,
        confidence,
        positiveIndicators: picked.positiveIndicators,
        negativeIndicators: picked.negativeIndicators,
      }),
      opportunities,
      analysis,
    }

    emitPriceEvent('booking.recommendation', {
      action: recommendation.action,
      confidence,
      opportunities,
    }, events)
    emitPriceEvent('price.analysis.finished', {
      action: recommendation.action,
      confidence,
      durationMs: Date.now() - started,
    }, events)

    return {
      version: SPRINT81_PRICE_INTELLIGENCE_VERSION,
      recommendation,
      events,
      durationMs: Date.now() - started,
    }
  }
}

export function createBookingTimingEngine(): BookingTimingEngine {
  return new BookingTimingEngine()
}

export function runBookingTiming(input: PriceIntelligenceInput): BookingTimingResult {
  return createBookingTimingEngine().analyze(input)
}
