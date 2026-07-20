/**
 * Cost Optimizer — compare flight/hotel/package/split combinations.
 */

import { convertMoney } from './normalize'
import type { CostCombination, MoneyAmount, RankedOffer } from './types'

export function optimizeBookingCombinations(input: {
  ranked: RankedOffer[]
  targetCurrency: string
  maxCombos?: number
}): CostCombination[] {
  const flights = input.ranked.filter((o) => o.domain === 'flights').slice(0, 4)
  const hotels = input.ranked.filter((o) => o.domain === 'hotels').slice(0, 4)
  const activities = input.ranked.filter((o) => o.domain === 'activities').slice(0, 2)
  const transfers = input.ranked.filter((o) => o.domain === 'airport_transfer').slice(0, 2)
  const cars = input.ranked.filter((o) => o.domain === 'car_rental').slice(0, 1)
  const insurance = input.ranked.filter((o) => o.domain === 'insurance').slice(0, 1)

  const combos: CostCombination[] = []

  if (!flights.length && !hotels.length) return []

  for (const flight of flights.length ? flights : [null]) {
    for (const hotel of hotels.length ? hotels : [null]) {
      if (!flight && !hotel) continue
      const parts: RankedOffer[] = []
      if (flight) parts.push(flight)
      if (hotel) parts.push(hotel)
      const activity = activities[0]
      if (activity) parts.push(activity)
      const transfer = transfers[0]
      if (transfer) parts.push(transfer)

      combos.push(buildCombo({
        id: `split:${flight?.id ?? 'none'}:${hotel?.id ?? 'none'}`,
        strategy: 'split',
        parts,
        flightId: flight?.id ?? null,
        hotelId: hotel?.id ?? null,
        activityIds: activity ? [activity.id] : [],
        transferId: transfer?.id ?? null,
        carRentalId: null,
        insuranceId: null,
        targetCurrency: input.targetCurrency,
        label: labelSplit(flight, hotel),
      }))
    }
  }

  // Package-style: top flight + top hotel + insurance
  if (flights[0] && hotels[0]) {
    const parts = [flights[0], hotels[0], ...(insurance[0] ? [insurance[0]] : [])]
    combos.push(buildCombo({
      id: `package:${flights[0].id}:${hotels[0].id}`,
      strategy: 'package',
      parts,
      flightId: flights[0].id,
      hotelId: hotels[0].id,
      activityIds: [],
      transferId: null,
      carRentalId: null,
      insuranceId: insurance[0]?.id ?? null,
      targetCurrency: input.targetCurrency,
      label: 'Best value package',
      packageDiscount: 0.04,
    }))
  }

  // Mixed: flight + car + transfer (no hotel) for flights-only style trips
  if (flights[0] && cars[0]) {
    const parts = [flights[0], cars[0], ...(transfers[0] ? [transfers[0]] : [])]
    combos.push(buildCombo({
      id: `mixed:${flights[0].id}:${cars[0].id}`,
      strategy: 'mixed',
      parts,
      flightId: flights[0].id,
      hotelId: null,
      activityIds: [],
      transferId: transfers[0]?.id ?? null,
      carRentalId: cars[0].id,
      insuranceId: null,
      targetCurrency: input.targetCurrency,
      label: 'Flight + ground transport',
    }))
  }

  combos.sort((a, b) => b.valueScore - a.valueScore || a.total.amount - b.total.amount)
  return combos.slice(0, input.maxCombos ?? 8)
}

function buildCombo(input: {
  id: string
  strategy: CostCombination['strategy']
  parts: RankedOffer[]
  flightId: string | null
  hotelId: string | null
  activityIds: string[]
  transferId: string | null
  carRentalId: string | null
  insuranceId: string | null
  targetCurrency: string
  label: string
  packageDiscount?: number
}): CostCombination {
  const sum = input.parts.reduce((s, part) => {
    const amount = part.price.normalizedAmount ?? part.price.amount
    return s + convertMoney({ amount, currency: part.price.normalizedCurrency || part.price.currency }, input.targetCurrency).amount
  }, 0)
  const discounted = input.packageDiscount ? sum * (1 - input.packageDiscount) : sum
  const total: MoneyAmount = {
    amount: Math.round(discounted),
    currency: input.targetCurrency,
    normalizedAmount: Math.round(discounted),
    normalizedCurrency: input.targetCurrency,
  }
  const avgRank = input.parts.reduce((s, p) => s + p.rankScore, 0) / Math.max(1, input.parts.length)
  const valueScore = clamp01(avgRank * 0.7 + (1 / (1 + total.amount / 5000)) * 0.3)
  return {
    id: input.id,
    strategy: input.strategy,
    flightId: input.flightId,
    hotelId: input.hotelId,
    activityIds: input.activityIds,
    transferId: input.transferId,
    carRentalId: input.carRentalId,
    insuranceId: input.insuranceId,
    total,
    valueScore,
    label: input.label,
  }
}

function labelSplit(flight: RankedOffer | null, hotel: RankedOffer | null): string {
  if (flight && hotel) return `Split: ${short(flight.title)} + ${short(hotel.title)}`
  if (flight) return `Flight only: ${short(flight.title)}`
  if (hotel) return `Hotel only: ${short(hotel.title)}`
  return 'Combination'
}

function short(title: string): string {
  return title.length > 28 ? `${title.slice(0, 28)}…` : title
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}
