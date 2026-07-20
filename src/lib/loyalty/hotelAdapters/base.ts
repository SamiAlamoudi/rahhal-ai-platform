/**
 * Sprint 38 — Hotel loyalty adapter contract (sandbox; no live SDKs).
 */

import type { HotelLoyaltyAccount, HotelLoyaltyBrand, LoyaltyCandidate } from '../types'

export interface HotelLoyaltyAdapter {
  readonly brand: HotelLoyaltyBrand
  readonly programName: string
  estimatePoints(candidate: LoyaltyCandidate, account?: HotelLoyaltyAccount | null): number
  normalizeAccount(memberNumber: string, pointsBalance?: number, tierName?: string | null): HotelLoyaltyAccount
}

export function createHotelAdapter(
  brand: HotelLoyaltyBrand,
  programName: string,
  earnPerCurrency: number,
): HotelLoyaltyAdapter {
  return {
    brand,
    programName,
    estimatePoints(candidate, account) {
      const base = Math.round(candidate.price * earnPerCurrency)
      const tierBoost = account?.tierName?.toLowerCase().includes('gold')
        || account?.tierName?.toLowerCase().includes('diamond')
        ? 1.25
        : 1
      return Math.round(base * tierBoost)
    },
    normalizeAccount(memberNumber, pointsBalance = 0, tierName = null) {
      return {
        brand,
        programName,
        memberNumber,
        pointsBalance,
        tierName,
      }
    },
  }
}
